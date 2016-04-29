#!/bin/bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DIR="$( cd "$( dirname "$SCRIPT_DIR" )" && pwd )"
LOGNAME=${DIR//\//_}

forever -w --watchDirectory $DIR -a -l ~/.forever/"$LOGNAME-daemon.log" --workingDir $DIR start "$DIR/daemon.js"
