# Usa uma imagem oficial e leve do Node.js
FROM node:20-alpine

# Define o diretório de trabalho dentro do container
WORKDIR /usr/src/app

# Copia apenas os arquivos de dependências primeiro (otimiza o cache do Docker)
COPY package*.json ./

# Instala as dependências
RUN npm install

# Copia o restante do código da aplicação
COPY . .

# Expõe a porta definida no seu servidor
EXPOSE 3000

# Comando para iniciar o estado zero
CMD ["node", "server.js"]