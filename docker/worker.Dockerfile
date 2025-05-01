
FROM rocker/r-ver:4.3.1

# Install system dependencies
RUN apt-get update && apt-get install -y \
      libcurl4-openssl-dev libssl-dev libxml2-dev \
      nodejs npm \
 && R -q -e "install.packages(c('tidyverse','rvest','progress'), repos='https://cloud.r-project.org')"

WORKDIR /app
COPY . /app

# Install Node.js dependencies
RUN cd workers && npm install

# Set execute permissions for the runner script
RUN chmod +x workers/run_models.sh

CMD ["/bin/bash", "workers/run_models.sh"]
