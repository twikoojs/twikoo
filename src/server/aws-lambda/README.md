# AWS Lambda

Deploy Twikoo to [AWS Lambda](https://docs.aws.amazon.com/lambda/latest/dg/urls-invocation.html).

## Deploy with Terraform

```bash
cd terraform

# Update MONGODB_URI
vim terraform.tfvars

# Init Terraform modules
terraform init

# Deploy to AWS
terraform apply
```
