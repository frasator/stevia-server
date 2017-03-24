
##############################################################################################


init.report <- function(tool){
  res <- list()
  res$tool <- tool
  res$input <- list()
  res$output <- list()
  return(res)
}

add.input <- function(res,element){
  res$input[[length(res$input)+1]] <- element
  return(res)
}

add.input.param <- function(res,key,value){
  element <- list()
  element$type <- "param"
  element$key <- key
  element$value <- value
  res <- add.input(res,element)
  return(res)
}

add.output <- function(res,element){
  res$output[[length(res$output)+1]] <- element
  return(res)
}

add.section <- function(res,title, level=0){
  element <- list()
  element$type <- "section"
  element$title <- title
  element$level <- level
  res <- add.output(res,element)
  return(res)
}

add.redirection <- function(res, tool,file,level=0, ...){
  element <- list()
  element$type <- "redirection"
  element$tool <- tool
  element$file <- file
  element$level <- level

  element <- append(element, as.list(substitute(list(...)))[-1L])

  res <- add.output(res, element)
  return(res)
}

add.message <- function(res,text, level=0){
  element <- list()
  element$type <- "message"
  element$text <- text
  element$level <- level
  res <- add.output(res,element)
  return(res)
}

add.param <- function(res,key,value){
  element <- list()
  element$type <- "param"
  element$key <- key
  element$value <- value
  res <- add.output(res,element)
  return(res)
}

add.image <- function(res,title,file, level=0){
  element <- list()
  element$type <- "image"
  element$title <- title
  element$file <- file
  element$level <- level
  res <- add.output(res,element)
  return(res)
}

add.heatmap <- function(res,title,file, level=0){
  element <- list()
  element$type <- "heatmap"
  element$title <- title
  element$file <- file
  element$level <- level
  res <- add.output(res,element)
  return(res)
}

add.table <- function(res,title,file,level=0,page_size=10){
  element <- list()
  element$type <- "table"
  element$title <- title
  element$file <- file
  element$page_size <- page_size
  element$level <- level
  res <- add.output(res,element)
  return(res)
}

add.boxPlot <- function(res,title,file="boxplot.csv",outliers="outliers.csv",level=0){
  element <- list()
  element$type <- "boxplot"
  element$title <- title
  element$file <- file
  element$outliers <- outliers
  element$level <- level
  res <- add.output(res,element)
  return(res)
}

add.download <- function(res,title,file,level=0){
  element <- list()
  element$type <- "download"
  element$title <- title
  element$file <- file
  element$level <- level
  res <- add.output(res,element)
  return(res)
}

add.html <- function(res,file, level=0){
  element <- list()
  element$type <- "html"
  element$file <- file
  element$level <- level
  res <- add.output(res,element)
  return(res)
}

add.go.viewer <- function(res, title, sub.network, sub.attributes, all.attributes, level=0){
  element <- list()
  element$type <- "goviewer"
  element$title <- title
  element$sub.network <- sub.network
  element$sub.attributes <- sub.attributes
  element$all.attributes <- all.attributes
  element$level <- level
  res <- add.output(res,element)
  return(res)
}

add.protein.viewer <- function(res,title,file,level=0){
  element <- list()
  element$type <- "proteinviewer"
  element$title <- title
  element$file <- file
  element$level <- level
  res <- add.output(res,element)
  return(res)
}

render.xml <- function(res){

  out <- paste0("<report tool='",res$tool,"'>\n")
  out <- paste0(out,"\t<input-params>\n")
  for(element in res$input){
    out <- paste0(out,"\t\t<param key='",element$key,"' value='",element$value,"'></param>\n")
  }
  out <- paste0(out,"\t</input-params>\n")
  out <- paste0(out,"\t<output-params>\n")
  for(element in res$output){
    switch(element$type,
           section = {
             out <- paste0(out,"\t\t<section level='",element$level,"' title='",element$title,"'></section>\n")
           },
           message = {
             out <- paste0(out,"\t\t<message level='",element$level,"' text='",element$text,"'></message>\n")
           },
           param = {
             out <- paste0(out,"\t\t<param key='",element$key,"' value='",element$value,"'></param>\n")
           },
           image = {
             out <- paste0(out,"\t\t<image level='",element$level,"' title='",element$title,"' file='",element$file,"'></image>\n")
           },
           table = {
             out <- paste0(out,"\t\t<table level='",element$level,"' title='",element$title,"' file='",element$file,"' page-size='",element$page_size,"'></table>\n")
           },
           boxplot = {
             out <- paste0(out,"\t\t<boxplot level='",element$level,"' title='",element$title,"' file='",element$file,"' outliers='",element$outliers,"'></boxplot>\n")
           },
           goviewer = {
             out <- paste0(out,"\t\t<goViewer level='",element$level,"' title='",element$title,"' sub-network='",element$sub.network,"' sub-attributes='",element$sub.attributes,"' all.attributes='",element$all.attributes,"'></goViewer>\n")
           },
           heatmap = {
             out <- paste0(out,"\t\t<heatmap level='",element$level,"' title='",element$title,"' file='",element$file,"'></heatmap>\n")
           },
           proteinviewer = {
             out <- paste0(out,"\t\t<proteinviewer level='",element$level,"' title='",element$title,"' file='",element$file,"'></proteinviewer>\n")
           },
           download = {
             out <- paste0(out,"\t\t<download level='",element$level,"' title='",element$title,"' file='",element$file,"'></download>\n")
           },
           html = {
             out <- paste0(out,"\t\t<html level='",element$level,"' file='",element$file,"'></html>\n")
           },
           redirection = {
             attrs <- ""
             for(key in names(element)){
               if(!(key == "tool") & !(key == "file") & !(key == 'type')){
                 attrs <- paste0(attrs, key, "='",element[key]  ,"' ")
               }
             }
             out <- paste0(out, "\t\t<redirection tool='", element$tool, "' file='", element$file  ,"' ",attrs, "></redirection>\n")

           }
    )
  }
  out <- paste0(out,"\t</output-params>\n")
  out <- paste(out,"</report>")

  return(out)
}
