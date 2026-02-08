import { Router, Request, Response } from "express";
import { getX402Context } from "@apitoll/seller-sdk";

const router = Router();

const jokes = [
  "Why do programmers prefer dark mode? Because light attracts bugs!",
  "How many programmers does it take to change a light bulb? None, that's a hardware problem.",
  "Why do Java developers wear glasses? Because they can't C#!",
  "What's a programmer's favorite hangout place? The Foo Bar.",
  "Why did the programmer quit his job? Because he didn't get arrays!",
  "What do you call a programmer from Finland? Nerdic.",
  "Why do programmers always mix up Christmas and Halloween? Because Oct 31 == Dec 25!",
  "What's the object-oriented way to become wealthy? Inheritance.",
  "A SQL query walks into a bar, walks up to two tables, and asks: 'Can I join you?'",
  "There are only 10 kinds of people in the world: those who understand binary, and those who don't.",
  "Why was the JavaScript developer sad? Because he didn't Node how to Express himself.",
  "What's a pirate's favorite programming language? R!",
  "To understand recursion, you must first understand recursion.",
  "99 little bugs in the code, 99 little bugs. Take one down, patch it around... 127 little bugs in the code.",
  "A programmer's wife tells him: 'Go to the store and get a loaf of bread. If they have eggs, get a dozen.' He comes home with 12 loaves.",
];

router.get("/api/joke", (_req: Request, res: Response) => {
  const joke = jokes[Math.floor(Math.random() * jokes.length)];
  const ctx = getX402Context(_req);

  res.json({
    joke,
    payment: ctx?.receipt
      ? {
          txHash: ctx.receipt.txHash,
          amount: ctx.receipt.amount,
          from: ctx.receipt.from,
          chain: ctx.receipt.chain,
        }
      : null,
  });
});

export default router;
