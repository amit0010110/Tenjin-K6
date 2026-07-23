#!/bin/bash

# Color codes for pretty printing
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== TenjinT6 Performance Testing Platform ===${NC}"

# Help message
show_help() {
    echo "Usage: ./run.sh [options]"
    echo ""
    echo "Options:"
    echo "  --docker      Run the application using Docker Compose"
    echo "  --install     Force install/update of npm dependencies"
    echo "  --reset-db    Reset/re-push the database schema (will delete existing dev database data)"
    echo "  --help        Show this help message"
}

# Parse options
DOCKER_MODE=false
FORCE_INSTALL=false
RESET_DB=false

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --docker) DOCKER_MODE=true ;;
        --install) FORCE_INSTALL=true ;;
        --reset-db) RESET_DB=true ;;
        --help) show_help; exit 0 ;;
        *) echo -e "${RED}Unknown option: $1${NC}"; show_help; exit 1 ;;
    esac
    shift
done

if [ "$DOCKER_MODE" = true ]; then
    echo -e "${GREEN}Starting application in Docker mode...${NC}"
    
    # Check if docker daemon is running
    if ! docker info >/dev/null 2>&1; then
        echo -e "${RED}Error: Docker daemon is not running. Please start Docker and try again.${NC}"
        exit 1
    fi
    
    docker-compose up --build
    exit 0
fi

# Local run mode
echo -e "${GREEN}Starting application in Local mode...${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed. Please install Node.js (v18+) and try again.${NC}"
    exit 1
fi

# Install dependencies if not present or forced
if [ ! -d "node_modules" ] || [ "$FORCE_INSTALL" = true ]; then
    echo -e "${BLUE}Installing dependencies...${NC}"
    npm install
fi

# Build packages/shared (critical for backend/frontend to run)
if [ ! -d "packages/shared/dist" ] || [ "$FORCE_INSTALL" = true ]; then
    echo -e "${BLUE}Building shared package...${NC}"
    npm run build -w packages/shared
fi

# Generate Prisma Client
echo -e "${BLUE}Generating Prisma Client...${NC}"
npm run db:generate -w packages/backend

# Handle database push/reset
if [ "$RESET_DB" = true ]; then
    echo -e "${RED}Resetting database...${NC}"
    # Delete the local sqlite db if it exists
    rm -f packages/backend/prisma/dev.db
    npm run db:push -w packages/backend
else
    # Check if sqlite file exists, if not run db:push to create it
    if [ ! -f "packages/backend/prisma/dev.db" ]; then
        echo -e "${BLUE}Database not found. Initializing database schema...${NC}"
        npm run db:push -w packages/backend
    fi
fi

# Run the dev servers
echo -e "${GREEN}Starting frontend & backend development servers...${NC}"
npm run dev
