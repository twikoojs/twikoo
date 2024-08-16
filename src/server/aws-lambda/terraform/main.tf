terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 4.0"
    }
  }
}

provider "aws" {
  region = var.region
}

module "lambda_function" {
  source  = "terraform-aws-modules/lambda/aws"
  version = "7.4.0"

  function_name = "twikoo"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 60

  source_path = "../src"

  environment_variables = {
    MONGODB_URI = var.mongodb_uri
  }

  create_lambda_function_url = true
}

output "lambda_function_url" {
  value = module.lambda_function.lambda_function_url
}
