#!/bin/bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DIR="$( cd "$( dirname "$SCRIPT_DIR" )" && pwd )"
DIRNAME = "$( dirname "${BASH_SOURCE[0]}" )"

tail -f ~/.forever/"$DIRNAME-server.log" -n 200
