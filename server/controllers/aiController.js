import Resume from "../models/Resume.js";
import ai from "../configs/ai.js";

const normalizeWhitespace = (value = "") => value.replace(/\s+/g, " ").trim();

const ensureSentenceEnding = (value = "") => {
    const text = normalizeWhitespace(value);
    if(!text) return "";
    return /[.!?]$/.test(text) ? text : `${text}.`;
}

const toSentenceCase = (value = "") => {
    const text = normalizeWhitespace(value);
    if(!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
}

const extractQuotedText = (value = "") => {
    const match = value.match(/"([\s\S]+)"/);
    return normalizeWhitespace(match?.[1] || value);
}

const extractAiErrorMessage = (error) => {
    return error?.body?.error?.message || error?.error?.message || error?.message || "AI request failed";
}

const isBlockedAiProviderError = (error) => {
    const message = extractAiErrorMessage(error).toLowerCase();
    return error?.status === 401 || error?.status === 403 || message.includes("api key was reported as leaked") || message.includes("permission_denied");
}

const enhanceSummaryLocally = (userContent = "") => {
    const rawSummary = extractQuotedText(userContent)
        .replace(/^enhance my professional summary/i, "")
        .replace(/^professional summary[:\s-]*/i, "");

    const summary = toSentenceCase(rawSummary);
    const yearsMatch = summary.match(/(\d+)\+?\s+years?/i);
    const hackathonsMatch = summary.match(/(\d+)\s+hackathons?/i);
    const hasCompetitiveProgramming = /\bcp\b|competitive programming/i.test(summary);
    const likesBuilding = /build|builder|building/i.test(summary);

    const strengths = [];
    if (yearsMatch) strengths.push(`${yearsMatch[1]} years of experience`);
    if (hasCompetitiveProgramming) strengths.push("competitive programming");
    if (likesBuilding) strengths.push("building practical products");

    const firstSentence = strengths.length
        ? `Motivated software candidate with ${strengths.join(", ")} and a strong focus on solving real-world problems.`
        : `Motivated software candidate with hands-on problem-solving ability and a strong focus on building impactful solutions.`;

    const secondSentenceParts = [];
    if (hackathonsMatch) secondSentenceParts.push(`Recognized for winning ${hackathonsMatch[1]} hackathons`);
    if (summary) secondSentenceParts.push(`bringing strengths in ${summary.toLowerCase()}`);

    const secondSentence = secondSentenceParts.length
        ? `${secondSentenceParts.join(", ")} while continuing to grow as a reliable, results-oriented developer.`
        : `Brings a growth mindset, strong collaboration, and a commitment to delivering clear, ATS-friendly impact.`;

    return `${firstSentence} ${toSentenceCase(secondSentence)}`;
}

const enhanceJobDescriptionLocally = (userContent = "") => {
    const matchedPrompt = userContent.match(/enhance this job description\s+([\s\S]*?)\s+for the position of\s+([\s\S]*?)\s+at\s+([\s\S]*?)\.?$/i);

    const rawDescription = normalizeWhitespace(matchedPrompt?.[1] || userContent);
    const position = normalizeWhitespace(matchedPrompt?.[2] || "the role");
    const company = normalizeWhitespace(matchedPrompt?.[3] || "the company");
    const polishedDescription = ensureSentenceEnding(toSentenceCase(rawDescription.replace(/^job description[:\s-]*/i, "")));

    if (polishedDescription) {
        return `Delivered impact as ${position} at ${company} by ${polishedDescription.charAt(0).toLowerCase() + polishedDescription.slice(1)}`;
    }

    return `Delivered impact as ${position} at ${company} through cross-functional collaboration, strong execution, and measurable contributions to team goals.`;
}

const getChatCompletion = async (systemPrompt, userPrompt, options = {}) => {
    const response = await ai.chat.completions.create({
        model: process.env.OPENAI_MODEL,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ],
        ...options,
    });

    return response.choices[0].message.content;
}

// controller for enhancing a resume's professional summary
// POST: /api/ai/enhance-pro-sum
export const enhanceProfessionalSummary = async (req, res) => {
    try {
        const { userContent } = req.body;

        if(!userContent){
            return res.status(400).json({message: 'Missing required fields'})
        }

        const enhancedContent = await getChatCompletion(
            "You are an expert in resume writing. Your task is to enhance the professional summary of a resume. The summary should be 1-2 sentences also highlighting key skills, experience, and career objectives. Make it compelling and ATS-friendly. Only return the final text.",
            userContent
        );

        return res.status(200).json({enhancedContent})
    } catch (error) {
        if (isBlockedAiProviderError(error)) {
            return res.status(200).json({
                enhancedContent: enhanceSummaryLocally(req.body.userContent),
                warning: "The configured AI provider is currently unavailable, so a local enhancement fallback was used."
            })
        }

        return res.status(error?.status || 400).json({message: extractAiErrorMessage(error)})
    }
}

// controller for enhancing a resume's job description
// POST: /api/ai/enhance-job-desc
export const enhanceJobDescription = async (req, res) => {
    try {
        const { userContent } = req.body;

        if(!userContent){
            return res.status(400).json({message: 'Missing required fields'})
        }

        const enhancedContent = await getChatCompletion(
            "You are an expert in resume writing. Your task is to enhance the job description of a resume. The job description should be 1-2 sentences highlighting key responsibilities and achievements with action-oriented, ATS-friendly language. Only return the final text.",
            userContent
        );

        return res.status(200).json({enhancedContent})
    } catch (error) {
        if (isBlockedAiProviderError(error)) {
            return res.status(200).json({
                enhancedContent: enhanceJobDescriptionLocally(req.body.userContent),
                warning: "The configured AI provider is currently unavailable, so a local enhancement fallback was used."
            })
        }

        return res.status(error?.status || 400).json({message: extractAiErrorMessage(error)})
    }
}

// controller for uploading a resume to the database
// POST: /api/ai/upload-resume
export const uploadResume = async (req, res) => {
    try {
       
        const {resumeText, title} = req.body;
        const userId = req.userId;

        if(!resumeText){
            return res.status(400).json({message: 'Missing required fields'})
        }

        const systemPrompt = "You are an expert AI Agent to extract data from resume."

        const userPrompt = `extract data from this resume: ${resumeText}
        
        Provide data in the following JSON format with no additional text before or after:

        {
        professional_summary: { type: String, default: '' },
        skills: [{ type: String }],
        personal_info: {
            image: {type: String, default: '' },
            full_name: {type: String, default: '' },
            profession: {type: String, default: '' },
            email: {type: String, default: '' },
            phone: {type: String, default: '' },
            location: {type: String, default: '' },
            linkedin: {type: String, default: '' },
            website: {type: String, default: '' },
        },
        experience: [
            {
                company: { type: String },
                position: { type: String },
                start_date: { type: String },
                end_date: { type: String },
                description: { type: String },
                is_current: { type: Boolean },
            }
        ],
        project: [
            {
                name: { type: String },
                type: { type: String },
                description: { type: String },
            }
        ],
        education: [
            {
                institution: { type: String },
                degree: { type: String },
                field: { type: String },
                graduation_date: { type: String },
                gpa: { type: String },
            }
        ],          
        }
        `;

        const extractedData = await getChatCompletion(
            systemPrompt,
            userPrompt,
            { response_format: {type:  'json_object'} }
        );

        const parsedData = JSON.parse(extractedData)
        const newResume = await Resume.create({userId, title, ...parsedData})

        res.json({resumeId: newResume._id})
    } catch (error) {
        if (isBlockedAiProviderError(error)) {
            return res.status(503).json({message: "The configured AI provider is unavailable right now. Rotate the leaked Gemini API key in your env and try again."})
        }

        return res.status(error?.status || 400).json({message: extractAiErrorMessage(error)})
    }
}
