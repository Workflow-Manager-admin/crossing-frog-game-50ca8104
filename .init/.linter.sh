#!/bin/bash
cd /home/kavia/workspace/code-generation/crossing-frog-game-50ca8104/frog_street_crossing_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

