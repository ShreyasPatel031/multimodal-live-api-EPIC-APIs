# ---- Build Stage ----
    FROM node:20 AS build

    # Set working directory
    WORKDIR /app
    
    # Copy package.json and lock files
    COPY package*.json ./
    
    # Install dependencies
    RUN npm install
    
    # Copy the rest of the application code
    COPY . .
    
    # Build the React application
    RUN npm run build
    
    # ---- Production Stage ----
    FROM node:20 AS production
    
    # Set working directory
    WORKDIR /app
    
    # Copy the build folder and server files from the build stage
    COPY --from=build /app/build ./build
    COPY --from=build /app/server.js .
    COPY --from=build /app/package*.json ./
    
    # Install only production dependencies
    RUN npm install --production
    
    # Copy privatekey.pem if required (handle this securely in production)
    COPY --from=build /app/privatekey.pem .
    
    # Expose the port the app runs on
    EXPOSE 8080
    
    # Start the server
    CMD ["node", "server.js"]
    