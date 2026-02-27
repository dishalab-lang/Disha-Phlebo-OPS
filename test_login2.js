import fetch from 'node-fetch';

async function testLogin() {
  const res = await fetch('http://127.0.0.1:3000/api/calls', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Text:", text);
}
testLogin();
