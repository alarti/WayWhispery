// This is a serverless function that acts as a secure proxy to the GitHub Gist API.
// It's designed for platforms like Vercel or Netlify.

// We use node-fetch for making requests in a Node.js environment.
// In a real deployment, this would be a dependency in package.json.
const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // Allow CORS for all origins
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle pre-flight CORS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { guideData } = req.body;

    if (!guideData) {
        return res.status(400).json({ message: 'guideData is required' });
    }

    const token = process.env.GIST_TOKEN;
    if (!token) {
        return res.status(500).json({ message: 'GIST_TOKEN is not configured on the server.' });
    }

    const gistPayload = {
        description: `${guideData.guideName || 'Interactive Guide'} - by ${guideData.author || 'Anonymous'}`,
        public: true,
        files: {
            "guide.json": {
                content: JSON.stringify(guideData, null, 2)
            }
        }
    };

    try {
        const response = await fetch('https://api.github.com/gists', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `token ${token}`
            },
            body: JSON.stringify(gistPayload)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to create Gist.');
        }

        res.status(201).json({ html_url: data.html_url });

    } catch (error) {
        console.error('Error creating Gist:', error);
        res.status(500).json({ message: `Error creating Gist: ${error.message}` });
    }
};
