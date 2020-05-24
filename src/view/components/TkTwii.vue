<template>
  <div class="card">
    <div class="card-content">
      <div class="content">
        <article class="media">
          <div class="media-left">
            <div class="image is-64x64">
              <img :src="avatar" alt="Avatar">
            </div>
          </div>
          <div class="media-content">
            <div class="content">
              <strong>{{ author }}</strong> <small>@johnsmith</small> <small>31m</small>
              <div v-html="content"></div>
            </div>
            <nav class="level is-mobile">
              <div class="level-left">
                <a class="level-item" aria-label="reply">
                  <span class="icon is-small">
                    <i class="fas fa-reply" aria-hidden="true"></i>
                  </span>
                </a>
                <a class="level-item" aria-label="retweet">
                  <span class="icon is-small">
                    <i class="fas fa-retweet" aria-hidden="true"></i>
                  </span>
                </a>
                <a class="level-item" aria-label="like">
                  <span class="icon is-small">
                    <i class="fas fa-heart" aria-hidden="true"></i>
                  </span>
                </a>
              </div>
            </nav>
          </div>
        </article>
      </div>
    </div>
    <footer class="card-footer">
      <a href="#" class="card-footer-item">阅读</a>
      <a href="#" class="card-footer-item">评论</a>
      <a href="#" class="card-footer-item">点赞</a>
    </footer>
  </div>
</template>

<script>
export default {
  props: {
    avatar: String,
    author: String,
    content: String
  }
}
</script>