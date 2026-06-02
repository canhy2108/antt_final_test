# Use the official Node.js image as the base
FROM node:21-slim

# Set the working directory inside the container
WORKDIR /var/www/html

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Ensure all dependencies are built correctly
RUN npm rebuild

# Expose the port the app will run on
EXPOSE 3000

# Build the application
RUN npm run build

# Start the app
CMD ["npm", "run", "start"]