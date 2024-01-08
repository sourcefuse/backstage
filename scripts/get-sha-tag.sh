#!/bin/bash

REF_TAG=$(git describe --all --abbrev=0 HEAD^)
TAG="${REF_TAG#tags/}"

echo $TAG || echo null
