```
  ┌─┬─┬─┐
  ├─┼─┼─┤   S P E E D C U B E   T I M E R
  └─┴─┴─┘
```

Scramble a cube. Spin it in 3D. Hold space. Go fast. Get on the board.

Works on **2×2 all the way up to 7×7**. 🧊

---

## 🚀 Run it

```bash
npm install
```

Grab a free Postgres from [neon.tech](https://neon.tech) and copy the URL.
Or spin one up locally:

```bash
docker run --name cube-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 -d postgres:16
# → postgresql://postgres:dev@localhost:5432/postgres
```

Make a secret:

```bash
openssl rand -base64 32
```

Drop both into `.env`:

```
DATABASE_URL="postgresql://..."
AUTH_SECRET="that-random-string"
```

Tables, then liftoff:

```bash
npx prisma db push
npm run dev
```

→ **localhost:3000** 🎉

---

## ⌨️ How to drive it

| Do this | Get that |
| --- | --- |
| Hold `space`, let go | timer starts |
| Press anything | timer stops |
| Drag the cube | spin it |
| `2×2 … 7×7` | switch puzzle |
| **Solution** tab | it solves the scramble for you |
| **+2 / DNF** | fix a bad solve |

Signed out? Times live in your browser. Sign in and they follow you around + you show up on the leaderboard.

---

## 🧠 The solver is honest, not clever

It solves the 2×2 and 3×3 layer by layer, like a human would — cross, F2L, OLL, PLL.

It **works every time**. It is also **long**: ~88 moves where a proper solver does 20. That's the deal with the beginner method.

Want to see it check its own homework?

```bash
npm run verify:cube
```

4,800 solves, two completely separate cube models compared against each other. Takes about 30 seconds. ✅

---

## 🙈 Stuff that isn't here

- **No solutions for 4×4+** — scrambles, timer, 3D view all work. Solving big cubes needs a whole other algorithm.
- **No password reset** — needs an email service. Forget your password, make a new account. 🤷
- **No email verification** — nobody checks your address is real.
- **Rate limiting is soft** — it's in memory, so on Vercel it's a speed bump, not a wall.

---

## ☁️ Ship it

```bash
git init && git add -A && git commit -m "cube time"
gh repo create cube-timer --private --source=. --push
```

Then on Vercel: import repo → **Storage** → add Postgres → **Settings → Env Vars** → add `AUTH_SECRET` → deploy.

One last thing, or your tables won't exist:

```bash
DATABASE_URL="<production url>" npx prisma db push
```

---

## 🗺️ Where things live

```
src/lib/cube/facelet.ts   the N×N cube itself
src/lib/cube/cubie.ts     the 3×3 solver
src/components/Timer.tsx  hold-to-start timer
src/components/CubeView.tsx  the spinny 3D bit
src/app/api/              solves, leaderboard, signup
prisma/schema.prisma      the database
```

---

**Something broken?**

| It says | Do this |
| --- | --- |
| `did not initialize yet` | `npx prisma generate` |
| `db push` blows up | your `DATABASE_URL` is wrong |
| blank page after sign-in | `AUTH_SECRET` is missing |

Now go turn some plastic. 🏁

 **Live:** [speecubetimer.vercel.app](https://speecubetimer.vercel.app/)
