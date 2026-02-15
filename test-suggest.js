const testAPI = async () => {
    try {
        const res = await fetch('http://localhost:3000/api/ai/suggest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fieldType: 'degree', context: '', currentValue: '' }),
        });
        const data = await res.json();
        console.log('Status:', res.status);
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    }
};

testAPI();
