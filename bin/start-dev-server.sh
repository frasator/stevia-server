#!/bin/bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DIR="$( cd "$( dirname "$SCRIPT_DIR" )" && pwd )"

forever -w --watchDirectory $DIR -a -l ~/.forever/"$DIR-server.log" --workingDir $DIR start "$DIR/server.js"
