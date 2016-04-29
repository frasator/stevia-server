#!/bin/bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DIR="$( cd "$( dirname "$SCRIPT_DIR" )" && pwd )"
DIRNAME = "$( dirname "$SCRIPT_DIR" )"

forever -w --watchDirectory $DIR -a -l ~/.forever/"$DIRNAME-daemon.log" --workingDir $DIR start "$DIR/daemon.js"
