import { z } from "zod";
import { Hono } from "hono";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { tool } from "@langchain/core/tools";
import {
    createChatTemplate,
    messagesToTemplate,
} from "../utils/ChatTemplate.js";

const llmRouter = new Hono();

// 更新 messageTemplateSchema 以支持 Template 接口和数组 content
const messageTemplateSchema = z.object({
    role: z.enum(["system", "human", "ai", "user", "tool"]),
    content: z.union([z.string(), z.array(z.any())]),
    tool_calls: z.array(z.any()).optional().default([]),
    tool_call_id: z.string().optional().default(""),
    invalid_tool_calls: z.array(z.any()).optional().default([]),
});

const modelSchema = z.object({
    model_name: z.string(),
    provider_key: z.string(),
    provider_url: z.string(),
    temperature: z.number().min(0).max(2).optional(),
    top_p: z.number().min(0).max(1).optional(),
    max_tokens: z.number().int().positive().optional(),
});

const playgroundSchema = z.object({
    messages: z.array(messageTemplateSchema),
    inputs: z.record(z.any()).optional().default({}),
    model: modelSchema,
    tools: z
        .array(
            z.object({
                name: z.string(),
                description: z.string(),
                schema: z.record(z.any()), // JSON Schema 对象
            }),
        )
        .optional(),
    output_schema: z.record(z.any()).optional(), // JSON Schema 对象
});

async function createChain(body: any) {
    const { messages, inputs, model, tools, output_schema } =
        playgroundSchema.parse(body);

    const { model_name, ...modelParams } = model;

    const camelCaseParams = Object.fromEntries(
        Object.entries(modelParams).map(([key, value]) => [
            key.replace(/_([a-z])/g, (g) => g[1].toUpperCase()),
            value,
        ]),
    );

    const chat = new ChatOpenAI({
        modelName: model_name,
        temperature: 0,
        ...camelCaseParams,
        configuration: {
            apiKey: model.provider_key,
            baseURL: model.provider_url,
        },
    });

    // 将 Template 格式转换为 LangChain 期望的格式
    // 对于包含图片的情况，需要特殊处理
    const promptTemplate = createChatTemplate(messages);

    let finalModel: any = chat;
    if (output_schema) {
        // output_schema 已经是 JSON Schema 格式，不需要转换
        finalModel = chat.withStructuredOutput(output_schema);
    } else if (tools) {
        finalModel = chat.bindTools(
            tools.map((i) =>
                tool(() => {}, {
                    name: i.name,
                    description: i.description,
                    schema: i.schema, // i.schema 已经是 JSON Schema 格式
                }),
            ),
        );
    }

    return { messages, inputs, chat };
}

llmRouter.post("/invoke", async (c) => {
    try {
        const body = await c.req.json();
        const { messages, chat } = await createChain(body);

        const result = await chat.invoke(messages);

        return c.json(result as any);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ errors: error.errors }, 400);
        }
        console.error(error);
        return c.json({ error: "An unexpected error occurred." }, 500);
    }
});

llmRouter.post("/stream", async (c) => {
    try {
        const body = await c.req.json();
        const { messages, chat } = await createChain(body);

        // Enable streaming for the chat model
        chat.streaming = true;

        const stream = await chat.stream(messages);

        return c.newResponse(
            new ReadableStream({
                async start(controller) {
                    const encoder = new TextEncoder();

                    try {
                        for await (const chunk of stream) {
                            const data = JSON.stringify(chunk);
                            controller.enqueue(
                                encoder.encode(`data: ${data}\n\n`),
                            );
                        }
                        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                    } catch (error) {
                        console.error("Stream error:", error);
                        const errorData = JSON.stringify({
                            error: "Stream error occurred",
                        });
                        controller.enqueue(
                            encoder.encode(`data: ${errorData}\n\n`),
                        );
                    } finally {
                        controller.close();
                    }
                },
            }),
            {
                headers: {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    Connection: "keep-alive",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type",
                },
            },
        );
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ errors: error.errors }, 400);
        }
        console.error(error);
        return c.json({ error: "An unexpected error occurred." }, 500);
    }
});

export { llmRouter };
