# API Keys Setup Guide

## Polymarket API Key

### Where to Add the API Key

After running the bootstrap script, edit the file:

**`packages/server/.env`**

Find this line:
```
POLYMARKET_API_KEY=
```

And replace it with your actual API key:
```
POLYMARKET_API_KEY=your_actual_api_key_here
```

### How to Get a Polymarket API Key

1. **Visit Polymarket's Developer Portal**
   - Go to: https://polymarket.com/ (or their developer documentation)
   - Look for "API" or "Developer" section in the navigation

2. **Sign Up / Log In**
   - Create an account or log in to your existing Polymarket account

3. **Navigate to API Settings**
   - Go to your account settings
   - Look for "API Keys" or "Developer Settings"
   - Or visit: https://polymarket.com/settings/api (if available)

4. **Generate a New API Key**
   - Click "Generate New API Key" or "Create API Key"
   - Give it a descriptive name (e.g., "Strategy Marketplace Server")
   - Copy the API key immediately (you may not be able to see it again)

5. **Add to Your .env File**
   - Open `packages/server/.env`
   - Replace `POLYMARKET_API_KEY=` with `POLYMARKET_API_KEY=your_copied_key`

### Alternative: Using Public API (No Key Required)

If you don't have an API key, the code will still work using Polymarket's public API endpoint. However:
- ⚠️ You may encounter rate limits
- ⚠️ Less reliable for production use
- ✅ Fine for development and testing

The code automatically handles both cases - with or without an API key.

### Verifying Your API Key Works

1. Start the server:
   ```bash
   cd packages/server
   pnpm dev
   ```

2. Check the logs - you should see:
   ```
   [Engine] Updated signal: BUY_YES (mid: 0.4523, mid_bps: 4523)
   ```

3. If you see errors, check:
   - The API key is correctly formatted (no extra spaces)
   - The API key has the right permissions
   - Your network connection is working

## Solana RPC (Optional for Production)

### Current Setup (Devnet - No Key Required)

The project uses the public Solana devnet RPC:
```
https://api.devnet.solana.com
```

This works fine for development and testing.

### For Production / Higher Rate Limits

If you need better performance or higher rate limits, consider:

1. **Helius** (https://www.helius.dev/)
   - Free tier available
   - Sign up and get an API key
   - Update `RPC_URL` in `packages/server/.env`:
     ```
     RPC_URL=https://rpc-devnet.helius.xyz/?api-key=YOUR_HELIUS_KEY
     ```

2. **QuickNode** (https://www.quicknode.com/)
   - Free tier available
   - Create a devnet endpoint
   - Update `RPC_URL` in `packages/server/.env`:
     ```
     RPC_URL=https://your-endpoint.solana-devnet.quiknode.pro/YOUR_KEY/
     ```

3. **Alchemy** (https://www.alchemy.com/)
   - Free tier available
   - Create a Solana devnet app
   - Update `RPC_URL` in `packages/server/.env`

### Frontend RPC (Optional)

If you want to use a dedicated RPC for the frontend as well:

1. Edit `packages/frontend/.env.local`
2. Update `NEXT_PUBLIC_RPC_URL` with your provider's endpoint

## Security Notes

⚠️ **Never commit API keys to git!**

The `.env` and `.env.local` files are already in `.gitignore`, but always double-check:
- ✅ `.env` files are in `.gitignore`
- ✅ Never share your API keys publicly
- ✅ Use different keys for development and production
- ✅ Rotate keys if they're accidentally exposed

## Troubleshooting

### "Invalid API key" error
- Check for extra spaces or newlines in your `.env` file
- Verify the key is correct by copying it again
- Make sure you're using the right key type (API key, not OAuth token)

### Rate limit errors
- Add an API key if you're using the public endpoint
- Consider upgrading your API plan
- Add retry logic or rate limiting in your code

### Connection errors
- Check your internet connection
- Verify the API endpoint URL is correct
- Check if Polymarket's API is experiencing issues

