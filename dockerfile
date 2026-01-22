FROM node:18-alpine

WORKDIR /app

COPY package.json .
RUN npm install

COPY . .

# make data dir
RUN mkdir -p data

EXPOSE 80

CMD ["npm", "start"]