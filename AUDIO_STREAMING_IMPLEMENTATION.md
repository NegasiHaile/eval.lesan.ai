# Audio Streaming Implementation Guide

## How It Currently Works

The audio streaming feature is designed to stream **publicly available audio files** from remote URLs through Next.js application. Here's the complete flow:

## 1. Frontend Request Flow

### AudioCard Component (`src/components/inputs/AudioCard.tsx`)

```typescript
// When an audio file needs to be played
const url = type === "input" ? input_url : task?.output;

// The audio element makes a request to API
<audio
  controls
  src={`/api/audio-stream/${encodeURIComponent(url as string)}`}
  className="w-full px-1 py-1 h-16 rounded-full"
>
```

**Key Points:**
- The original remote URL is **URL-encoded** before being passed to the API
- Example: `https://example.com/audio.mp3` becomes `/api/audio-stream/https%3A%2F%2Fexample.com%2Faudio.mp3`

## 2. Backend Streaming API (`src/app/api/audio-stream/[url]/route.ts`)

### Step 1: URL Decoding
```typescript
const { url } = await params;
const remoteUrl = decodeURIComponent(url);
// Converts back: https%3A%2F%2Fexample.com%2Faudio.mp3 → https://example.com/audio.mp3
```

### Step 2: Range Request Handling
```typescript
// Get the range header from browser (for seeking/partial content)
const range = req.headers.get("range") || "bytes=0-";

// Forward the range request to the remote server
const remoteRes = await fetch(remoteUrl, {
  headers: { Range: range },
});
```

**Why Range Requests?**
- Browsers send `Range: bytes=0-1024` when seeking in audio
- Allows users to jump to any part of the audio without downloading everything
- Essential for large audio files

### Step 3: Header Forwarding
```typescript
// Copy all headers from the remote response
const headers: Record<string, string> = {};
remoteRes.headers.forEach((value, key) => {
  headers[key] = value;
});
```

**Important Headers Preserved:**
- `Content-Type: audio/mpeg` - Tells browser it's an MP3
- `Content-Length: 8258104` - File size
- `Accept-Ranges: bytes` - Confirms range requests work
- `Cache-Control: max-age=1209600` - Caching info

### Step 4: Stream Response
```typescript
// Stream the audio data back to the browser
return new Response(remoteRes.body, {
  status: remoteRes.status,  // Usually 200 or 206 (partial content)
  headers,
});
```

## 3. Complete Request Flow Example

```
1. User clicks play on audio
   ↓
2. Browser requests: GET /api/audio-stream/https%3A%2F%2Farchive.org%2Fdownload%2Ftestmp3testfile%2Fmpthreetest.mp3
   ↓
3. API decodes URL: https://archive.org/download/testmp3testfile/mpthreetest.mp3
   ↓
4. API requests: GET https://archive.org/download/testmp3testfile/mpthreetest.mp3
   ↓
5. Remote server responds with audio data + headers
   ↓
6. API forwards everything to browser
   ↓
7. Browser plays the audio
```

## 4. Why This Works for Public Files Only

### ✅ What Works:
- **Public URLs**: `https://archive.org/download/testmp3testfile/mpthreetest.mp3`
- **CDN URLs**: `https://cdn.example.com/audio.mp3`
- **Public cloud storage**: `https://storage.googleapis.com/public-bucket/audio.mp3`

### ❌ What Doesn't Work:
- **Private URLs**: Require authentication headers
- **Signed URLs**: Expire and need regeneration
- **Local files**: Not accessible from server
- **CORS-restricted**: Some servers block server's requests

## 5. Browser Behavior

### Initial Request:
```
GET /api/audio-stream/[url]
Range: bytes=0-
```

### Seeking Request (when user drags progress bar):
```
GET /api/audio-stream/[url]
Range: bytes=1048576-2097151
```

### API Forwards:
```
GET https://remote-server.com/audio.mp3
Range: bytes=1048576-2097151
```

## 6. Error Handling

```typescript
try {
  // ... streaming logic
} catch (err) {
  console.error("Streaming error:", err);
  return new Response("Error streaming remote audio", { status: 500 });
}
```

**Common Errors:**
- `404`: Remote file not found
- `403`: Access denied (private file)
- `CORS`: Remote server blocks server
- `Network`: Connection issues

## 7. Performance Benefits

### ✅ Efficient Streaming:
- **Range requests**: Only download needed parts
- **No storage**: Don't store files on server
- **Caching**: Browser can cache based on remote headers
- **Memory efficient**: Stream directly without buffering

### 📊 Bandwidth Usage:
- User seeks to 50% → Only downloads from 50% onwards
- User pauses → No more data downloaded
- User replays → Uses browser cache if available

## 8. Current Limitations

### 🔒 Security:
- No authentication support
- No URL validation (could be exploited)
- No file size limits

### 🌐 CORS:
- Depends on remote server allowing domain
- Some servers block server-to-server requests

### 📁 File Types:
- Works with any audio format the browser supports
- No format validation or conversion

## 9. Testing the Implementation

### Test with Public Audio:
```typescript
// This should work
const testUrl = "https://archive.org/download/testmp3testfile/mpthreetest.mp3";

<AudioCard
  type="input"
  input_url={testUrl}
/>
```

### Check Network Tab:
1. Open browser dev tools
2. Go to Network tab
3. Play audio
4. Look for requests to `/api/audio-stream/`
5. Check response headers and status

## 10. Debugging Tips

### Check API Logs:
```typescript
console.log("params.url:", url);
console.log("headers", remoteRes.headers);
```

### Common Issues:
- **404**: Check if remote URL is accessible
- **CORS**: Try different public audio sources
- **Range errors**: Some servers don't support range requests

## Summary

The current implementation is a **simple proxy** that:
1. Takes a public URL
2. Forwards browser requests to the remote server
3. Streams the response back to the browser
4. Preserves all headers for proper audio playback

It's perfect for **public datasets** and **demo purposes**, but needs enhancement for private or authenticated audio sources.
