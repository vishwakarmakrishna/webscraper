const express = require('express');
const puppeteer = require('puppeteer');
const axios = require('axios');

const app = express();
const PORT = 3000;

const path = require('path');

// use .env file
require('dotenv').config();

// Serve static files (HTML, CSS, JavaScript)
app.use(express.static(path.join(__dirname, 'public')));
app.get('/dart', async (req, res) => {
    let browser;
    try {
        // Launch a new browser instance
        browser = await puppeteer.launch({ headless: false });
        const page = await browser.newPage();
        const initialUrl = 'https://pub.dev/';
        await page.goto(initialUrl);

        // Get all the elements with class 'mini-list-item-title'
        let elements = await page.$$('.mini-list-item-title');

        const results = [];

        for (let i = 0; i < elements.length; i++) {
            // Re-fetch elements to avoid staleness
            elements = await page.$$('.mini-list-item-title');
            const element = elements[i];

            // Click on the current element
            await Promise.all([
                element.click(),
                page.waitForNavigation({ waitUntil: 'load', timeout: 60000 })
            ]);

            // Extract details from the new page
            const newPageTitle = await page.title();
            const newPageElement = await page.$('.title');
            let elementText = null;
            if (newPageElement) {
                elementText = await page.evaluate(el => el.textContent, newPageElement);
            }

            results.push({ newPageTitle, elementText });



            console.log(`Finished extracting from link ${i + 1}`);

            const canGoBack = await page.evaluate(() => window.history.length > 1);
            console.log(`Can go back after extracting from link ${i + 1}:`, canGoBack);

            // Return to the initial page by navigating directly
            await page.goto(initialUrl, { waitUntil: 'load', timeout: 60000 });
            await page.waitForTimeout(800);  // A delay to ensure the page is stable

        }

        // Close the browser
        await browser.close();

        // Return the collected data
        res.json(results);

    } catch (error) {
        console.error('Error:', error);
        if (browser) await browser.close();
        res.status(500).json({ error: `Error: ${error.message}` });
    }
});

app.get('/job-search', async (req, res) => {
    const query = req.query.q; // Get the search query from the request
    // use .env file
    const cx = process.env.cx; // Replace with your own CX value
    const apiKey = process.env.apiKey; // Replace with your own API key

    const apiUrl = `https://www.googleapis.com/customsearch/v1?q=${query}&cx=${cx}&key=${apiKey}`;

    try {
        const response = await axios.get(apiUrl);
        res.json(response.data); // Send the search results as JSON response
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



app.get('/search', async (req, res) => {
    const query = req.query.query; // Get the query parameter

    // Launch Puppeteer browser and open Google search page
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto(`https://www.google.com/search?q=${query}`);
    await page.waitForSelector('.vNEEBe');
    // Extract company and job information
    const company = await page.$eval('.vNEEBe', (element) => element.textContent);
    const job = await page.$eval('.BjJfJf', (element) => element.textContent);

    // Click on the current job link
    await page.click('.BjJfJf');

    // Wait for the description to load
    await page.waitForSelector('.HBvzbc');

    // Extract job description
    const description = await page.$eval('.HBvzbc', (element) => element.textContent);

    // Close the browser
    await browser.close();

    // Return the extracted data
    res.json({ job, company, description });
});

app.get('/searchlist', async (req, res) => {
    const query = req.query.query;

    const browser = await puppeteer.launch({ headless: false });
    try {

        const initialUrl = `https://www.google.com/search?q=${query}`;
        const page = await browser.newPage();
        await page.goto(initialUrl);

        // Click on "More Jobs" to view more listings
        await page.click('.MzfCRe');

        // Wait for the results to load
        await page.waitForSelector('.gws-plugins-horizon-jobs__tl-lif').then(() => console.log('Results loaded!'));           // Extract details from the new page



        // Get all the elements with class 'mini-list-item-title'
        let elements = await page.$$('.gws-plugins-horizon-jobs__tl-lif');

        const results = [];

        for (let i = 0; i < elements.length; i++) {

            // Re-fetch elements to avoid staleness
            // elements = await page.$$('.gws-plugins-horizon-jobs__tl-lif');
            const element = elements[i];


            // Click on the current element
            await Promise.all([
                element.click(),
                element.tap(),
            ]);
            await page.waitForTimeout(1000);
            const companyOuter = await element.$('.vNEEBe');
            let companyOuterText = null;
            if (companyOuter) {
                companyOuterText = await page.evaluate(el => el.textContent, companyOuter);
            }

            let descriptionText = null;
            let getRootNodeText = null;
            let companyText = null;

            // Look for the parent div with class 'pE8vnd avtvi'

            const selectedDiv = await page.$('.KGjGe');
            if (selectedDiv) {
                //     // Find the child div with class 'nJlQNd sMzDkb' and match its text with companyText
                //     const companyDiv = await selectedDiv.$('.nJlQNd.sMzDkb');
                //     const companyDivText = companyDiv ? await page.evaluate(el => el.textContent, companyDiv) : null;

                //     if (companyText === companyDivText) {

                //         // If the texts match, extract the description
                //         const descriptionDiv = await selectedDiv.$('.HBvzbc');
                //         descriptionText = descriptionDiv ? await page.evaluate(el => el.textContent, descriptionDiv) : null;
                //     }
                // }




                const company = await selectedDiv.$('.nJlQNd.sMzDkb');

                if (company) {
                    companyText = await page.evaluate(el => el.textContent, company);
                }
                const descriptionDiv = await selectedDiv.$('.HBvzbc');
                // getRootNodeText = selectedDiv ? await page.evaluate(el => el.localName, selectedDiv) : null;
                descriptionText = descriptionDiv ? await page.evaluate(el => el.textContent, descriptionDiv) : null;

                companyOuterText = companyOuterText ? companyOuterText : null;
            }
            results.push({ company: { companyText, companyOuterText }, descriptionText, });

        }
        // Close the browser
        browser.close();

        // Return the extracted data
        res.json(results);

    } catch (error) {
        console.error('Error:', error);
        if (browser) await browser.close();
        res.status(500).json({ error: `${error}` });
    }
});



// Define a route to handle requests for the HTML page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
