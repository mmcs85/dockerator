FROM ubuntu:18.04
RUN apt-get update \
    && apt-get install -y software-properties-common \
    && add-apt-repository "deb http://security.ubuntu.com/ubuntu xenial-security main" \
    && apt-get update \
    && apt-get install -y --no-install-recommends wget ca-certificates \
    && wget https://github.com/dfuse-io/eos/releases/download/v2.0.3-dm/eosio_2.0.3-dm_ubuntu-18.04_amd64.deb \
    && apt install -y ./eosio_2.0.3-dm_ubuntu-18.04_amd64.deb \
    && wget https://github.com/dfuse-io/dfuse-eosio/releases/download/v0.1.0-beta1/dfuse-eosio_0.1.0-beta1_linux_x86_64.tar.gz \
    && tar -xzvf dfuse-eosio_0.1.0-beta1_linux_x86_64.tar.gz \
    && rm dfuse-eosio_0.1.0-beta1_linux_x86_64.tar.gz \
    && rm eosio_2.0.3-dm_ubuntu-18.04_amd64.deb \
    && mv dfuseeos /usr/local/bin/dfuseeos \
    && (echo "y" && cat) | dfuseeos init
