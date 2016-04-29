#!/bin/bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DIR="$( cd "$( dirname "$SCRIPT_DIR" )" && pwd )"
DIRNAME = "$( dirname "$SCRIPT_DIR" )"

forever -a -l ~/.forever/"$DIRNAME-server.log" --workingDir $DIR start "$DIR/server.js"
