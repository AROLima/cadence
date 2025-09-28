<script lang="ts">
  import '../app.css';
  import favicon from '$lib/assets/favicon.svg';
  import { ToastContainer } from '$lib';
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<ToastContainer />
<slot />
