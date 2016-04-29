#!/bin/bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DIR="$( cd "$( dirname "$SCRIPT_DIR" )" && pwd )"
LOGNAME = ${DIR//\//_}

tail -f ~/.forever/"$LOGNAME-server.log" -n 200
