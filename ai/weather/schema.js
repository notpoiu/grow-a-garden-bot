import { Type } from '@google/genai';

export const ResponseSchema = {
    type: Type.OBJECT,
    required: ["data"],
    properties: {
        data: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                required: ["prettifiedName", "associatedEmoji", "originalName"],
                properties: {
                    prettifiedName: {
                        type: Type.STRING,
                    },
                    associatedEmoji: {
                        type: Type.STRING,
                    },
                    originalName: {
                        type: Type.STRING,
                    },
                },
            },
        },
    },
};