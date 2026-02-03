const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function verify() {
    try {
        console.log('1. Logging in...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            username: 'admin',
            password: 'password123'
        });
        const token = loginRes.data.token;
        console.log('   Login successful. Token received.');

        console.log('\n2. Testing Valid Data Entry...');
        const validData = {
            date: '2025-02-01',
            totalSale: 2000,
            totalSaleGmv: 1500,
            gmvSaleLive: 1000,
            adsSpend: 500,
            ttamSpendAds: 100,
            ttamImpressions: 60000
        };

        try {
            const createRes = await axios.post(`${API_URL}/records`, validData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const d = createRes.data;
            console.log('   Record created.');

            // Verification of Formulas
            console.log('   Verifying formulas...');
            const expectedTotalAds = 500 + 100; // 600
            const expectedCPM = (100 / 60000) * 1000; // 1.666...
            const expectedROITotal = 2000 / 600; // 3.333...
            const expectedROIGmv = 1500 / 600; // 2.5

            const check = (name, actual, expected) => {
                const pass = Math.abs(actual - expected) < 0.01;
                console.log(`   - ${name}: ${actual.toFixed(2)} vs ${expected.toFixed(2)} [${pass ? 'PASS' : 'FAIL'}]`);
            };

            check('Total Ads Spend', d.totalAdsSpend, expectedTotalAds);
            check('CPM', d.cpm, expectedCPM);
            check('ROI Total', d.roiTotal, expectedROITotal);
            check('ROI GMV', d.roiGmv, expectedROIGmv);

        } catch (e) {
            if (e.response && e.response.data && e.response.data.error === 'Record for this date already exists.') {
                console.log('   Record already exists (run previously). Skipping creation.');
            } else {
                console.error('   Failed to create valid record:', e.response ? e.response.data : e.message);
            }
        }

        console.log('\n3. Testing Invalid Data Entry (Validation)...');
        const invalidData = {
            date: '2025-02-02',
            totalSale: 1000,
            totalSaleGmv: 2000, // Invalid: GMV > Total Sale
            gmvSaleLive: 1000,
            adsSpend: 500,
            ttamSpendAds: 100,
            ttamImpressions: 60000
        };

        try {
            await axios.post(`${API_URL}/records`, invalidData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('   [FAIL] Invalid record was accepted!');
        } catch (e) {
            if (e.response && e.response.status === 400) {
                console.log('   [PASS] Server rejected invalid data as expected.');
                console.log('   Error:', JSON.stringify(e.response.data));
            } else {
                console.log('   [FAIL] Unexpected error:', e.message);
            }
        }

    } catch (err) {
        console.error('Verification failed:', err.message);
        if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', JSON.stringify(err.response.data, null, 2));
        }
    }
}

verify();
