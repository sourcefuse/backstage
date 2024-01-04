#!/bin/bash

tfenv_path="$HOME/.tfenv"

if ! command -v tfenv &> /dev/null; then
  git clone --depth=1 https://github.com/tfutils/tfenv.git $tfenv_path
  ln -s $tfenv_path/bin/* /usr/local/bin
else
  printf "tfenv already exists...\n"
  :
fi
