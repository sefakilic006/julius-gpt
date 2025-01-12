import { ChatGPTAPI, ChatMessage, SendMessageOptions } from 'chatgpt'
import pRetry, { AbortError } from 'p-retry'
import { extractJsonArray, extractMarkdownCodeBlock, extractPostOutlineFromCodeBlock } from './extractor'
import {
  getPromptForMainKeyword,
  getPromptForOutline,
  getPromptForIntroduction,
  getPromptForHeading,
  getPromptForConclusion,
  getSystemPrompt
} from './prompts'
import {
  Heading,
  PostOutline,
  PostPrompt,
  TotalTokens
} from '../types'

import { encode } from './tokenizer'

/**
* Specific Open AI API parameters for the completion
*/
export type CompletionParams = {
  temperature?: number | null,
  top_p?: number | null,
  max_tokens?: number,
  presence_penalty?: number | null,
  frequency_penalty?: number | null,
  logit_bias?: object | null,

}

/**
 * Interface for the helper class for generating a post. it defines how to generate a post
 * Each helper class must implement this interface
 * @interface
 */
export interface GeneratorHelperInterface {
  init () : Promise<void>
  generateContentOutline () : Promise<PostOutline>
  generateMainKeyword () : Promise<string[]>
  generateIntroduction () : Promise<string>
  generateConclusion () : Promise<string>
  generateHeadingContents (tableOfContent : PostOutline) : Promise<string>
  getTotalTokens() : TotalTokens
  getPrompt() : PostPrompt
}

/**
 * Helper implementation for generating a post using the ChatGPT API
 * @class
 */
export class ChatGptHelper implements GeneratorHelperInterface {
  private api : ChatGPTAPI
  private chatOutlineMessage : ChatMessage
  private completionParams : CompletionParams
  private totalTokens : TotalTokens = {
    promptTokens: 0,
    completionTokens: 0,
    total: 0
  }

  public constructor (private postPrompt : PostPrompt) {
    this.api = new ChatGPTAPI({
      apiKey: postPrompt?.apiKey || process.env.OPENAI_API_KEY,
      completionParams: {
        model: postPrompt.model
      },
      systemMessage: getSystemPrompt(postPrompt),
      debug: postPrompt.debugapi
    })

    if (postPrompt.debug) {
      console.log(`OpenAI API initialized with model : ${postPrompt.model}`)
    }
  }

  getPrompt (): PostPrompt {
    return this.postPrompt
  }

  getTotalTokens (): TotalTokens {
    return this.totalTokens
  }

  async init () {
    this.completionParams = {
      temperature: this.postPrompt.temperature ?? 0.8,
      frequency_penalty: this.postPrompt.frequencyPenalty ?? 0,
      presence_penalty: this.postPrompt.presencePenalty ?? 1
    }

    if (this.postPrompt.logitBias) {
      const mainKwWords = await this.generateMainKeyword()
      // set the logit bias in order to force the model to minimize the usage of the main keyword
      const logitBiais : Record<number, number> = {}
      mainKwWords.forEach((kw) => {
        const encoded = encode(kw)
        encoded.forEach((element) => {
          logitBiais[element] = Number(this.postPrompt.logitBias) || -1
        })
      })
      this.completionParams.logit_bias = logitBiais
    }

    if (this.postPrompt.debug) {
      console.log('---------- COMPLETION PARAMETERS ----------')
      console.log('Max Tokens  : ' + this.completionParams.max_tokens)
      console.log('Temperature : ' + this.completionParams.temperature)
      console.log('Frequency Penalty : ' + this.completionParams.frequency_penalty)
      console.log('Presence Penalty : ' + this.completionParams.presence_penalty)
      console.log('Logit Biais : ' + this.completionParams.logit_bias)
    }
  }

  async generateMainKeyword () {
    const prompt = getPromptForMainKeyword()
    if (this.postPrompt.debug) {
      console.log('---------- PROMPT MAIN KEYWORD ----------')
      console.log(prompt)
    }
    const response = await this.sendRequest(prompt)
    if (this.postPrompt.debug) {
      console.log('---------- MAIN KEYWORD ----------')
      console.log(response.text)
    }

    return extractJsonArray(response.text)
  }

  async generateContentOutline () {
    const prompt = getPromptForOutline(this.postPrompt)
    if (this.postPrompt.debug) {
      console.log('---------- PROMPT OUTLINE ----------')
      console.log(prompt)
    }
    this.chatOutlineMessage = await this.sendRequest(prompt, this.completionParams)
    if (this.postPrompt.debug) {
      console.log('---------- OUTLINE ----------')
      console.log(this.chatOutlineMessage.text)
    }

    return extractPostOutlineFromCodeBlock(this.chatOutlineMessage.text)
  }

  async generateIntroduction () {
    const response = await this.sendRequest(getPromptForIntroduction(), this.completionParams)
    return extractMarkdownCodeBlock(response.text)
  }

  async generateConclusion () {
    const response = await this.sendRequest(getPromptForConclusion(), this.completionParams)
    return extractMarkdownCodeBlock(response.text)
  }

  async generateHeadingContents (postOutline : PostOutline) {
    const headingLevel = 2

    return await this.buildContent(postOutline.headings, headingLevel)
  }

  async buildContent (headings: Heading[], headingLevel : number, previousContent: string = ''): Promise<string> {
    if (headings.length === 0) {
      return previousContent
    }
    const [currentHeading, ...remainingHeadings] = headings

    const mdHeading = Array(headingLevel).fill('#').join('')
    let content = previousContent + '\n' + mdHeading + ' ' + currentHeading.title

    if (currentHeading.headings && currentHeading.headings.length > 0) {
      content = await this.buildContent(currentHeading.headings, headingLevel + 1, content)
    } else {
      content += '\n' + await this.getContent(currentHeading)
    }

    return this.buildContent(remainingHeadings, headingLevel, content)
  }

  async getContent (heading: Heading): Promise<string> {
    if (this.postPrompt.debug) {
      console.log(`\nHeading : ${heading.title}  ...'\n`)
    }
    const response = await this.sendRequest(getPromptForHeading(heading.title, heading.keywords), this.completionParams)
    return `${extractMarkdownCodeBlock(response.text)}\n`
  }

  private async sendRequest (prompt : string, completionParams? : CompletionParams) {
    return await pRetry(async () => {
      const options : SendMessageOptions = { parentMessageId: this.chatOutlineMessage?.id }
      if (completionParams) {
        options.completionParams = completionParams
      }

      const response = await this.api.sendMessage(prompt, options)
      this.totalTokens.promptTokens += response.detail.usage.prompt_tokens
      this.totalTokens.completionTokens += response.detail.usage.completion_tokens
      this.totalTokens.total += response.detail.usage.total_tokens
      return response
    }, {
      retries: 10,
      onFailedAttempt: async (error) => {
        if (this.postPrompt.debug) {
          console.log('---------- OPENAI REQUEST ERROR ----------')
          console.log(error)
        }
        if (error instanceof AbortError) {
          console.log('OpenAI API - Request aborted')
        } else {
          console.log(`OpenAI API - Request failed - Attempt ${error.attemptNumber} failed. There are ${error.retriesLeft} retries left.`)
        }
      }
    })
  }
}
