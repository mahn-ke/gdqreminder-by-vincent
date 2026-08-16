import fs from 'fs';
import path from 'path';

class Response
{
    #statusCode = null;
    #content = null;
    constructor(content)
    {
        if (!content)
        {
            this.#statusCode = 404;
            this.#content = null;
            return;
        }

        // convert content which is buffer to string
        this.#content = content.toString();
        const firstLine = this.#content.split("\n")[0];
        if (firstLine.match(/^\d+$/))
        {
            this.#statusCode = parseInt(firstLine);
            this.#content = this.#content.split("\n").slice(1).join("\n");
            return;
        }

        this.#statusCode = 200;
        this.#content = content;
    }

    get statusCode() 
    {
        return this.#statusCode;
    }

    get body()
    {
        return this.#content;
    }

    async json()
    {
        return JSON.parse(this.#content);
    }
}

export class PrefixEmptyError extends Error {}

export class FakeHTTPClient
{
    #prefix = "";
    #requestCount = 0;
    constructor(prefix)
    {
        this.setPrefix(prefix);
    }

    setPrefix(prefix)
    {
        this.#prefix = prefix;
        if (!this.#prefix)
        {
            throw new PrefixEmptyError();
        }
    }
    
    get(url)
    {
        ++this.#requestCount;
        const parsedURL = new URL(url);
        const fileName = parsedURL.search.replaceAll(/\W/g, "_").replaceAll(/^_?/g, "").replaceAll(/_?$/g, "");
        let parts = [
            "__tests__",
            "fixtures",
            this.#prefix,
            "GET",
            parsedURL.hostname + parsedURL.pathname.replaceAll(/\/$/g, ""),
            fileName,
        ].filter(entry=>!!entry);

        const filePath = path.resolve(path.dirname(''), parts.join("/")+".json");
        if (!fs.existsSync(filePath))
        {
            return new Response(null);
        }
        return new Response(fs.readFileSync(filePath));
    }
    
    post(url)
    {
        ++this.#requestCount;
        const parsedURL = new URL(url);
        let parts = [
            "__tests__",
            "fixtures",
            this.#prefix,
            "POST",
            parsedURL.hostname + parsedURL.pathname.replaceAll(/\/$/g, "")
        ].filter(entry=>!!entry);
        const filePath = path.resolve(path.dirname(''), parts.join("/") + ".json");
        return new Response(fs.readFileSync(filePath));
    }
}
