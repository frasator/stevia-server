#!/usr/bin/env python
import sys
import argparse
import os
import re

if sys.version_info < (2, 7):
    print "Must use python 2.7 or greater"
    exit()


from pprint import pprint


def main():
    parser = argparse.ArgumentParser(description="Export dataset to attrs")
    parser.add_argument("-i", "--input", help="Input VCF File", required=True)

    args = parser.parse_args()
    inputFile = args.input

    data_file = open(inputFile + ".txt", 'w')
    attrs_file = open(inputFile + ".txt.attrs", "w")

    variable_re = re.compile("^#VARIABLE\s+(\w+)\s+.*VALUES{(.*)}")
    name_re = re.compile("^#NAMES\s+(.*)")
    res = {}
    cols = []
    fields = []

    with open(inputFile) as f:
        for line in f:
            if variable_re.match(line):
                m = variable_re.match(line)
                attr_name = m.group(1)
                attr_values = m.group(2)
                res[attr_name] = attr_values.split(",");
                fields.append(attr_name)
            elif name_re.match(line):
                m = name_re.match(line)
                cols = m.group(1).split("\t")
                data_file.write(line)
            elif not line.startswith("^#"):
                data_file.write(line)

    if len(fields) > 0:
        attrs_file.write("#NAMES\t" + "\t".join(fields) + "\n")

        i=0
        for col in cols:
            aux = []
            aux.append(col)
            for field in fields:
                aux.append(res[field][i])
            attrs_file.write("\t".join(aux) + "\n")
            i = i + 1

    data_file.close()
    attrs_file.close()


if __name__ == "__main__":
    main()
