#!/bin/bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DIR="$( cd "$( dirname "$SCRIPT_DIR" )" && pwd )"
DIRNAME = "$( dirname "$SCRIPT_DIR" )"

tail -f ~/.forever/"$DIRNAME-daemon.log" -n 200
