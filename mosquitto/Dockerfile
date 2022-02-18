FROM archlinux:base-devel as builder

# Install required arch packages
RUN pacman -Syu --noconfirm \
    && pacman -S --noconfirm git go mosquitto

# Build mosquitto-go-auth plugin
RUN mkdir -p /opt \
    && git clone https://github.com/tilmann-bartsch/mosquitto-go-auth.git /opt/mosquitto-go-auth
WORKDIR /opt/mosquitto-go-auth
RUN git checkout feat/backend-oauth2 \
    && make

FROM archlinux:latest

RUN pacman -Syu --noconfirm \
    && pacman -S --noconfirm mosquitto \
    && yes | pacman -Scc

## Copy mosquitto-go-auth plugin
RUN mkdir -p /etc/mosquitto/conf.d
COPY --from=builder /opt/mosquitto-go-auth/go-auth.so /etc/mosquitto/conf.d

CMD ["mosquitto", "-c", "/mosquitto.conf"]

