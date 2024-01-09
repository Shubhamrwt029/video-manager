import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true })); // to access from different origins
app.use(express.json({ limit: "16kb" })); // acts as body parser to parse body in json
app.use(express.urlencoded({ extended: true, limit: "16kb" })); // parse url params like space %20 etc...
app.use(express.static("public")); // public folder added to keep data on the server like image, pdf ets...
app.use(cookieParser()); // parse cookie on the web

export { app };
