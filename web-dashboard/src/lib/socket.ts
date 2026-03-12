"use client";

import { io } from "socket.io-client";

// Use current origin if no URL provided (allows Next.js dev server to proxy to backend)
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "";

export const socket = io(SOCKET_URL, {
    transports: ["websocket"],
    autoConnect: true,
});
