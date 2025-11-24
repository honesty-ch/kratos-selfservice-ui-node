

## Sync with original project

initialize remote forked project

```sh
git remote add fromprj https://github.com/ory/kratos-selfservice-ui-node.git
git remote -v
```

synchronize forked project into "modified" branch

```sh
git fetch fromprj
git checkout modified
git merge fromprj/master
```

create a new docker

```sh
# kratos self service
docker build . -t "kratosss:latest"
```