const fetch = require('node-fetch');

async function test() {
  try {
    const res = await fetch('http://localhost:3001/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        addressId: "test",
        cartItems: [{ productId: "test", quantity: 1 }],
        paymentMethod: 'COD'
      })
    });
    console.log(res.status);
    console.log(await res.text());
  } catch (e) {
    console.error("Fetch failed:", e);
  }
}
test();
