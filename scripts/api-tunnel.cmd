@echo off
rem Public https tunnel to the local myQode server (port 2069) so a phone on mobile data can reach it.
rem Prints a https://....trycloudflare.com URL: put it in .env as EXPO_PUBLIC_API_BASE_URL, then  npx expo start --tunnel -c
rem The URL changes every time this is started. Keep this window open while testing; Ctrl+C stops it.
"%ProgramFiles(x86)%\cloudflared\cloudflared.exe" tunnel --url http://localhost:2069
