import fs from 'fs/promises';

export async function convertTxtToJson(content, jsonFilePath) {
    try {
        // Extract and parse the dictionary-like structure
        const jsonString = content.split('=')[1].trim();
        const jsonObject = eval('(' + jsonString + ')'); // Ensure file is trusted before using eval

        // Write JSON file
        await fs.writeFile(jsonFilePath, JSON.stringify(jsonObject, null, 4), 'utf8');
        console.log(`Converted JSON saved as ${jsonFilePath}`);
        return jsonObject;
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}

// Only run if this file is executed directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
    const txtFilePath = 'Spring 2025_Mid Sem.txt';
    const jsonFilePath = 'Spring_2025_Mid_Sem.json';
    const content = await fs.readFile(txtFilePath, 'utf8');
    convertTxtToJson(content, jsonFilePath);
}

// import fs from 'fs/promises';

// export async function convertTxtToJson(content, jsonFilePath) {
//     try {
//         // Log the full content to understand its structure
//         console.log("Full content of the text file:\n", content);

//         // Find the JSON part of the content (after 'slots =')
//         const jsonStartIndex = content.indexOf("{");
//         const jsonEndIndex = content.lastIndexOf("}") + 1;

//         // Extract the JSON string portion
//         const jsonString = content.slice(jsonStartIndex, jsonEndIndex).trim();

//         // Debugging log: Check the extracted JSON string
//         console.log("Extracted JSON:", jsonString);

//         // If the extracted string is empty, log a warning and return
//         if (!jsonString) {
//             console.error('Error: No valid JSON found in the text file.');
//             return;
//         }

//         // Parse the JSON string safely
//         const jsonObject = JSON.parse(jsonString);

//         // Write JSON file
//         await fs.writeFile(jsonFilePath, JSON.stringify(jsonObject, null, 4), 'utf8');
//         console.log(`Converted JSON saved as ${jsonFilePath}`);
//         return jsonObject;
//     } catch (error) {
//         console.error('Error:', error);
//         throw error;
//     }
// }

// // Only run if this file is executed directly
// if (process.argv[1] === new URL(import.meta.url).pathname) {
//     const txtFilePath = 'Spring 2025_Mid Sem.txt';
//     const jsonFilePath = 'Spring_2025_Mid_Sem.json';
//     const content = await fs.readFile(txtFilePath, 'utf8');
//     convertTxtToJson(content, jsonFilePath);
// }
