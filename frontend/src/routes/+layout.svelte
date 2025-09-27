<script lang="ts">
  import '../app.css';
  import favicon from '$lib/assets/favicon.svg';
  import { ToastContainer } from '$lib';

  const props = $props<{ children: () => unknown }>();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<ToastContainer />
{@render props.children?.()}
