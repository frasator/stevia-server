#!/bin/bash
date
ARGS=$@
echo $ARGS

SCRIPTDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

while [[ $# > 1 ]]
do
key="$1"

case $key in
    --outdir)
    OUTDIR="$2"
    shift # past argument
    ;;
esac
shift # past argument or value
done

cp $SCRIPTDIR/table.txt $OUTDIR/
cp $SCRIPTDIR/Leaf_icon_03.svg.png $OUTDIR/
cp $SCRIPTDIR/report.xml $OUTDIR/
