#!/bin/bash

EXTRA_ARGS=""
plan_id=$(git rev-parse --short "$GITHUB_SHA")
INIT=false
PLAN=false
APPLY=false

while getopts "hi:p:a:z:" option; do
  case $option in
    h) #show help
    help
    ;;
    i) #initialise backend
    export ENV=$OPTARG
    INIT=true
    ;;
    p) #run plan
    export ENV=$OPTARG
    PLAN=true
    ;;
    a) #run apply
    export ENV=$OPTARG
    APPLY=true
    ;;
    z) #pass extra arguments
    EXTRA_ARGS=$OPTARG
    ;;
    \?)
    echo "ERROR: Invalid option $option"
    echo "valid options are : [-i|p|a]"
    break;
    ;;
  esac
done

cleanup () {
  OPTIND=1
  unset EXTRA_ARGS
  unset INIT
  unset PLAN
  unset APPLY
}

help () {
    help () {
   printf "Script to run terraform actions in github actions. Source this with arguments\n"

   printf "\n"
   printf "Syntax: [-h|i|p|a|z]\n"
   printf "options:\n"
   printf "h     Print this help menu.\n"
   printf "i     run terraform init\n"
   printf "p     run terraform plan against passed env (requires env as argument)\n"
   printf "a     run terraform apply agaisnt passed env (requires env as argument)\n"
   printf "\n"
}
}

check_dir() {
 ! [ -d "terraform/" ]
}

init () {

  cd terraform/
  terraform init -backend-config config.$ENV.hcl $EXTRA_ARGS
  terraform workspace list

}

plan () {

  cd terraform/
  PLAN_FILENAME=$ENV-$plan_id.tfplan
  terraform workspace select $ENV || terraform workspace new $ENV
  terraform plan -var-file $ENV.tfvars $EXTRA_ARGS -out $PLAN_FILENAME
  PLAN_OUTPUT=$(terraform show -no-color $PLAN_FILENAME)

  echo "Terraform plan output for $ENV" >> $ENV-plan-output.txt
  echo "" >> $ENV-plan-output.txt
  echo "\`\`\`text" >> $ENV-plan-output.txt
  echo "" >> $ENV-plan-output.txt
  echo "$PLAN_OUTPUT" >> $ENV-plan-output.txt
  echo "" >> $ENV-plan-output.txt
  echo "\`\`\`" >> $ENV-plan-output.txt
  echo "" >> $ENV-plan-output.txt

}

apply () {

  cd terraform/
  terraform workspace select $ENV
  terraform apply -auto-approve $EXTRA_ARGS $ENV-$plan_id.tfplan

}

main () {
  if check_dir;
  then
    echo "ERROR: Invalid value for directory : terraform/ does not exist within current directory"
  return 1;
  fi

  if [[ ! $ENV =~ ^(prod|poc)$ ]];
  then
    echo "Invalid environment $ENV passed with plan/apply option"
  return
  fi

  if $INIT;
  then
    init
    return $?
  fi

  if $PLAN;
  then
    plan
    return $?
  fi

  if $APPLY;
  then
    apply
    return $?
  fi

}

main
cleanup
