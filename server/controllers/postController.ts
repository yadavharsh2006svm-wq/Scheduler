import { Response } from "express";
import { AuthRequest } from "../middlewares/authMiddlewware.js";
import { GoogleGenAI } from "@google/genai";
import { cloudinary } from "../config/cloudinary.js";
import { Generation } from "../models/Generation.js";
import { Post } from "../models/Post.js";
import axios from "axios";

// Generate post
// POST /api/posts/generate
export const generatePost = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const prompt = req.body?.prompt;
        const tone = req.body?.tone;
        // generateImage may arrive as a real boolean (JSON) or a string (FormData)
        const generateImage = req.body?.generateImage === true || req.body?.generateImage === "true";
        const referenceImage = req.file; // present only if user attached a photo

        if (!prompt && !referenceImage) {
            res.status(400).json({ message: "Please enter a prompt or attach a photo." });
            return;
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            res.status(400).json({ message: "Gemini API Key is missing. Please add it to your server/.env file." });
            return;
        }

        const ai = new GoogleGenAI({ apiKey });

        // ==========================================
        // 1. TEXT GENERATION (Gemini 3.6 Flash - Working Perfectly)
        // ==========================================
        const instructionText = `
You are an expert social media content creator.

${referenceImage
    ? "Analyze the uploaded image carefully. Describe only what is actually visible in the image. Do not make assumptions."
    : `Generate a social media post about "${prompt}".`
}

Tone: ${tone || "Professional"}.

Requirements:
- Write an engaging caption.
- Keep it platform friendly.
- Generate relevant hashtags.
- If an image is uploaded, write a short image description.
- If no image is uploaded, imageDescription should be an empty string.
- If an image is uploaded, imagePrompt should be an empty string.
- If no image is uploaded, generate a detailed imagePrompt for AI image generation.

Return ONLY valid JSON.

{
  "content": "",
  "hashtags": "",
  "imageDescription": "",
  "imagePrompt": ""
}
`;

        // Build multimodal contents when a reference photo is attached, otherwise plain text
        const contents: any = referenceImage
            ? [{
                role: "user",
                parts: [
                    { text: instructionText },
                    {
                        inlineData: {
                            mimeType: referenceImage.mimetype,
                            data: referenceImage.buffer.toString("base64"),
                        },
                    },
                ],
            }]
            : instructionText;

        let textResponse;
        const maxRetries = 3;
        let delay = 2000;

        for (let i = 0; i < maxRetries; i++) {
            try {
                console.log(`Generating text with Gemini 3.6 Flash... (Attempt ${i + 1})`);
                textResponse = await ai.models.generateContent({
                    model: "gemini-3.6-flash", 
                    contents,
                });
                break; 
            } catch (err: any) {
                if (err.status === 503 && i < maxRetries - 1) {
                    console.warn(`[API OVERLOAD] 503 High Demand. Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2; 
                } else {
                    throw err; 
                }
            }
        }

        if (!textResponse) {
             throw new Error("Google API is consistently busy. Please try again after a few minutes.");
        }

        console.log("====================================");
console.log(textResponse.text);
console.log("====================================");

        let content = "";
let hashtags = "";
let imageDescription = "";
let imagePrompt = prompt || "";

        try {
            const rawText = textResponse.text || "";
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            const data = jsonMatch ? JSON.parse(jsonMatch[0]) : { content: rawText, imagePrompt: prompt };
            content = data.content || "";

hashtags = data.hashtags || "";

imageDescription = data.imageDescription || "";

imagePrompt = data.imagePrompt || imagePrompt;
        } catch (e) {
            console.error("Failed to parse JSON:", e);
            content = textResponse.text || "";
        }

        // ==========================================
        // 2. MEDIA
        //    - If the user attached their own photo, use that photo directly.
        //    - Otherwise, optionally generate an AI image via Pollinations.
        // ==========================================
        let mediaUrl = "";
        let mediaType: "image" | undefined;

        if (referenceImage) {
            try {
                console.log("Uploading attached reference photo to Cloudinary...");
                const uploadResult = await new Promise<any>((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        { resource_type: "auto", folder: "ai-generations" },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result);
                        }
                    );
                    stream.end(referenceImage.buffer);
                });
                mediaUrl = uploadResult.secure_url;
                mediaType = "image";
            } catch (err: any) {
                console.error("Reference photo upload failed:", err.message);
                res.status(500).json({ message: "Photo upload failed.", details: err.message });
                return;

                console.log("Original Prompt:", prompt);
console.log("Image Prompt:", imagePrompt);
            }
        } else if (generateImage) {
    try {
        console.log("Generating image instantly...");

        // Encode prompt to make it URL safe
        const encodedPrompt = encodeURIComponent(imagePrompt);

        const pollinationsUrl =
            `https://image.pollinations.ai/prompt/${encodedPrompt}`;

        console.log("Pollinations URL:", pollinationsUrl);

        console.log("Uploading generated image to Cloudinary...");


  console.log("Pollinations URL:", pollinationsUrl);
                
                console.log("Uploading generated image to Cloudinary...");
                
                // Cloudinary is smart enough to download directly from a public URL!
                const response = await axios.get(pollinationsUrl, {
    responseType: "arraybuffer",
});



const imageBuffer = Buffer.from(response.data);

const uploadResult = await new Promise<any>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
        {
            folder: "ai-generations",
            resource_type: "image",
        },
        (error, result) => {
            if (error) reject(error);
            else resolve(result);
        }
    );

    stream.end(imageBuffer);
});

mediaUrl = uploadResult.secure_url;
mediaType = "image";

console.log("Image uploaded successfully!");
                console.log("Image successfully uploaded to Cloudinary!");

            } catch (err: any) {
                console.error("Image generation failed:", err.message);
                res.status(500).json({ 
                    message: "Image generation failed.", 
                    details: err.message 
                });
                return; 
            } 
        }

        // ==========================================
        // 3. SAVE TO DATABASE
        // ==========================================
        console.log("Saving generation record to Database...");
        const generation = await Generation.create({
    user: req.user._id,

    prompt: prompt || "Uploaded Image",

    content,

    hashtags,

    imageDescription,

    mediaUrl,

    mediaType,

    tone
});
console.log("Saved Generation:");
console.log(generation.toObject());


        res.json(generation);
        
    } catch (error: any) {
        console.error("Critical server error during generation:", error);
        res.status(500).json({ message: error?.message || "Server error" });
    }
}

// ... (keep your getGenerations, getPosts, schedulePost methods same as before) ...

// Get generations
// GET /api/posts/generations
export const getGenerations = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const generations = await Generation.find({user: req.user._id}).sort({createdAt: -1})
        res.json(generations)
    } catch (error: any) {
        res.status(500).json({ message: error?.message || "Server error" });
    }
}

// Get posts
// GET /api/posts
export const getPosts = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const posts = await Post.find({user: req.user._id})
        res.json(posts)
    } catch (error: any) {
        res.status(500).json({ message: error?.message || "Server error" });
    }
}

// Schedule post
// POST /api/posts
export const schedulePost = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { content, platforms, scheduledFor, status } = req.body;

        let parsedPlatforms = platforms;
        if(typeof platforms === "string"){
            try {
                parsedPlatforms = JSON.parse(platforms)
            } catch (e) {
                parsedPlatforms = platforms.split(",");
            }
        }

        let mediaUrl: string | undefined = req.body.mediaUrl;
        let mediaType: "image" | "video" | undefined = req.body.mediaType;

        if(req.file){
            const result = await new Promise<any>((resolve, reject)=>{
                const stream = cloudinary.uploader.upload_stream({resource_type: "auto", folder: "social-scheduler"}, (error, result)=>{
                    if(error) reject(error);
                    else resolve(result)
                });
                stream.end(req.file!.buffer);
            });
            mediaUrl = result.secure_url;
            mediaType = result.resource_type === "video" ? "video" : "image";
        }

        const post = await Post.create({
            user: req.user._id,
            content,
            platforms: parsedPlatforms,
            mediaUrl,
            mediaType,
            scheduledFor,
            status,
        })
        res.status(201).json(post)

    } catch (error: any) {
        res.status(500).json({ message: error?.message || "Server error" });
    }
}