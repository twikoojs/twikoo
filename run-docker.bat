@echo off
echo 正在启动Twikoo Docker容器...
docker run -d --name twikoo-container -p 8080:8080 -v %cd%\data:/app/data twikoo:latest
echo Twikoo容器已启动！
echo 访问地址: http://localhost:8080
echo 查看日志: docker logs twikoo-container
pause