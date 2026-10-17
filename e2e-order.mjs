const origin = 'http://localhost:5000';
const j = async (res) => {
  const t = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, t };
};

const post = (path, body, token) =>
  fetch(`${origin}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body || {}),
  }).then(j);
const put = (path, body) =>
  fetch(`${origin}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  }).then(j);

// 1. register temp member, no funds
let r = await post('/api/auth/app-register', {
  nickname: 'OrderT2', username: '03005678901', password: 'test123', confirmPassword: 'test123', securityPin: '1234',
});
const token = r.t.data.token;
const mid = r.t.data.member._id;
console.log('registered', r.t.data.member.nickname, mid);

// 2. funds check -> insufficient
r = await post('/api/orders/start', {}, token);
console.log('start(no funds) ->', r.status, r.t.message);

// 3. add funds
r = await put(`/api/members/${mid}/balance`, { action: 'add', amount: 5000 });
console.log('balance', r.t.data.availableFunds);

// 4. start -> assigned
r = await post('/api/orders/start', {}, token);
const p1 = r.t.data.order.productName;
console.log('start#1 ->', r.status, r.t.data.order.productName, r.t.data.order.commission, r.t.data.order.transactionVolume);

// 5. start again -> SAME product (2.1)
r = await post('/api/orders/start', {}, token);
const p2 = r.t.data.order.productName;
console.log('start#2 -> same?', p1 === p2, p2);

// 6. complete
r = await post(`/api/orders/${r.t.data.order._id}/complete`, {}, token);
console.log('complete ->', r.status, 'funds', r.t.data.member.availableFunds, 'task', r.t.data.member.taskStatus, 'profit', r.t.data.member.todayProfit);

// 7. start again -> DIFFERENT product (no repeat today)
r = await post('/api/orders/start', {}, token);
const p3 = r.t.data.order.productName;
console.log('start#3 -> different?', p1 !== p3, p3);

// cleanup
if (r.t && r.t.data && r.t.data.order) {
  await post(`/api/orders/${r.t.data.order._id}/complete`, {}, token).catch(() => {});
}
const del = await fetch(`${origin}/api/members/${mid}`, { method: 'DELETE' }).then(j);
console.log('cleanup member ->', del.status);