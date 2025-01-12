# Intro 
This nodejs CLI and API gives you the ability to generate content with the OpenAI API (GPT-4 by default). 

# How it works ?

It uses a series of prompts to generate content : 
- Generate the outline of the post (with the SEO description, SEO title, the slug)
- Generate the introduction
- Generate the content of the different sections of the outline
- Generate the conclusion


One of the problems of AI content generation is the repetition of the main keywords. 
This script also uses the temperature, logit_bias, frequency penalty, presence penalty parameters to try to minimize this. 
See the [OpenAI API documentation](https://platform.openai.com/docs/api-reference/completions) for more details.

When generating, the CLI gives you the ability to publish the content on your wordpress blog.
Other CMS will be supported in the future. We need to support some headless CMS.

**This is an experimental project. You are welcome to suggest improvements, like other prompts and other values for the parameters.**
**The cost of the API calls is not included in the price of the CLI. You need to have an OpenAI API key to use this CLI.**

# Examples

## Generated with version 0.0.9

![Example](./examples/cli-output.png)

Markdown result : [Top 4x4 RVs for an Unforgettable Vanlife Experience](./examples/rv4x4.md)

json file  : [rv4x4.json](./examples/rv4x4.json)

## Generated with version 0.0.11

Markdown result : [How to Generate Great Content with GPT-4](./examples/generate-content-gpt4.md)

json file  : [generate-content-gpt4.json](./examples/generate-content-gpt4.json)

# Installation

CLI and API are available as a npm package.


```bash
# for the API
npm install julius-gpt -S
# for the CLI
npm install -g julius-gpt
```

# CLI
The CLI has 2 groups of commands :
- post : generate a post
- wp : wordpress related commands : list, add, remove, update wp sites & publish posts 


```bash
~ julius -h   
Usage: julius [options] [command]

Generate and publish your content from the command line 🤯

Options:
  -V, --version   output the version number
  -h, --help      display help for command

Commands:
  post [options]  Generate a post
  wp              Wordpress related commands. The wp list is stored in the local store : ~/.julius/wordpress.json
  help [command]  display help for command


```
## Generate a post

**You need to have an OpenAI API key to use this CLI**
You can specify the API key with the `-k` option or with the environment variable `OPENAI_API_KEY`.

```bash
 ~ julius post -h
Usage: julius post [options]

Generate a post

Options:
  -d, --debug           output extra debugging
  -da, --debugapi       debug the api calls
  -k, --apiKey <key>    set the OpenAI api key. use only for the wp post command
  -h, --help            display help for command
```

The CLI will ask you some questions to generate the post :
- language : we support all languages supported by GPT-4
- model : GPT-4 or GPT-3.5-turbo
- filename : the cli generate an md & json file with the content of the post based on the filename. The json file can be used to publish the post on a Wordpress site.
- title/topic
- country (optional)
- intent (optional)
- audience (optional)
- with conclusion : if true, the generated content will contain a conclusion
- temperature (optional)
- Frequency Penalty (optional)
- Presence Penalty (optional)
- Logit bias (optional)


## Wordpress related commands

### list
This command displays the list of all registered Wordpress sites in the local file ~/.julius/wordpress.json. 

**The domain name or the id of the site can be used for the following commands.**

```bash
~ julius wp ls
```

### add
This command adds a new Wordpress site to the local file ~/.julius/wordpress.json.

```bash
~ julius wp add www.domain.com:username:password
```

### info

This command displays the list of all registered Wordpress sites in the local file ~/.julius/wordpress.json.

```bash
~ julius wp info www.domain.com|id
```
### rm

This command removes a Wordpress site from the local file ~/.julius/wordpress.json.

```bash
~ julius wp rm www.domain.com|id
```

### export

This command exports the list of all registered Wordpress sites in the local file ~/.julius/wordpress.json.

```bash
~ julius wp export wordpress_sites.json
```

### import

This command imports the list of all registered Wordpress sites in the local file ~/.julius/wordpress.json.

```bash
~ julius wp import wordpress_sites.json
```

### categories

This command displays the list of all categories of a Wordpress site.

```bash
~ julius wp categories www.domain.com|id
```
### post

This command publishes a post on a Wordpress site.
the json file must have the following structure : 
```json
{
    "title": "The title of the post",
    "slug": "the-slug-of-the-post",
    "content": "The content of the post",
    "seoTitle": "The SEO title of the post",
    "seoDescription": "The SEO description of the post",
}
```

This json file can be generated with the command `julius post` or with the API.

```bash
~ julius wp post www.domain.com|id categoryId true post.json
```

- The first argument is the domain name or the id of the site.
- The second argument is the id of the category on this word. you can get the list of categories with the command `julius wp categories www.domain.com|id`
- The third argument is a boolean to indicate if the wp used Yoast SEO plugin. If true, the SEO title and description will be published.
- The fourth argument is the path to the json file containing the post.


# API

```js
import { OpenAIPostGenerator, Post, PostPrompt } from 'julius-gpt'

async function main () {
  const prompt : PostPrompt = {
    topic: 'How to generate a great content with GPT-4 ?',
    language: 'english', // could be any language supported by GPT-4
    withConclusion: true,
    model: 'gpt-4', // or gpt-3.5-turbo
    apiKey: ' ...', // optional if you use the env var OPENAI_API_KEY
    country: '...', // optional
    intent: '...', // optional
    audience: '...', // optional
    temperature: 0.8, // optional
    frequencyPenalty: 0, // optional
    presencePenalty: 1, // optional
    logitBias: 0, // optional
    debug: true, // optional
    debugapi: true // optional
  }

  const postGenerator = new OpenAIPostGenerator(prompt)
  const post : Post = await postGenerator.generate()
  console.log(post)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

```

## Somes tools that can help to check the quality


# TODO
- custom prompts
- Personalize the post outline
- Generate images 
- Massively generate content

# Credit 
- [OpenAI API](https://openai.com/) 
- [Travis Fisher](https://transitivebullsh.it/) for his excellent [NodeJS client for OpenAI](https://github.com/transitive-bullshit/chatgpt-api)