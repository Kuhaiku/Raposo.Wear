# Usa uma imagem leve do Node
FROM node:20-alpine

# Define o diretório de trabalho
WORKDIR /usr/src/app

# Copia os arquivos de dependências da pasta backend
COPY backend/package*.json ./backend/

# Entra na pasta e instala
RUN cd backend && npm install

# Copia o restante dos arquivos do projeto
COPY . .

# Expõe a porta
EXPOSE 3000

# Inicia o servidor dentro da pasta backend
CMD ["node", "backend/src/server.js"]