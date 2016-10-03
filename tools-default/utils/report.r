
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


######### html

# html_param <- function(key,value){
#   html <- paste0("<blockquote><span style='color: #777777';>",key,": </span><span style='color: #aaaaff;'>",value,"</span></blockquote>\n")
#   return(html)
# }
# html_title <- function(title){
#   html <- "<blockquote><div style='width=100%; border-bottom: dashed 2px #aaaaff; color:#aaaaff;'>\n"
#   html <- paste0(html,"<h2>",title,"</h2>\n")
#   html <- paste0(html,"</div></blockquote>\n")
#   return(html)
# }
# html_image <- function(file,title){
#   html <- "<blockquote><br><div>\n"
#   html <- paste0(html,"   <h4>",title,"</h4>\n")
#   html <- paste0(html,"   <img src='",file,"'/>\n")
#   html <- paste0(html,"</div></blockquote>\n")
#   return(html)
# }
# html_table <- function(file,title){
#   html <- "<blockquote><div>\n"
#   html <- paste0(html,"   <h4>",title,"</h4>\n")
#   html <- paste0(html,"   <a href='",file,"'>",basename(file),"</a>\n")
#   html <- paste0(html,"</div></blockquote>\n")
#   return(html)
# }

# extra_javascript <- ""
# 
# before_html <- ""
# before_html <- paste(before_html,html_title("Input params"),sep="<br>\n")
# before_html <- paste(before_html,html_param("Expression file",basename(exp_file)),sep="\n")
# before_html <- paste(before_html,html_param("Design file",basename(design_file)),sep="\n")
# before_html <- paste(before_html,html_param("Decomposed paths",decompose),sep="\n")
# before_html <- paste(before_html,html_param("GO",go),sep="\n")
# before_html <- paste(before_html,html_param("Uniprot keywords",uniprot),sep="\n")
# before_html <- paste(before_html,html_title("Path values"),sep="<br>\n")
# before_html <- paste(before_html,html_table("paths_vals.txt","Path values"),sep="<br>\n")
# before_html <- paste(before_html,html_image("paths_heatmap.png","Heatmap"),sep="<br>\n")
# before_html <- paste(before_html,html_image("paths_pca.png","PCA"),sep="<br>\n")
# before_html <- paste(before_html,html_table("paths_comparison.txt","Path significance"),sep="<br>\n")
# 
# after_html <- ""
# if(go==T){
#   after_html <- paste(after_html,html_title("GO values"))
#   after_html <- paste(after_html,html_table("go_vals.txt","GO term values"),sep="<br>\n")
#   after_html <- paste(after_html,html_image("go_heatmap.png","Heatmap"),sep="<br>\n")
#   after_html <- paste(after_html,html_image("go_pca.png","PCA"),sep="<br>\n")
#   after_html <- paste(after_html,html_table("go_comparison.txt","GO term significance"),sep="<br>\n")
# }
# if(uniprot==T){
#   after_html <- paste(after_html,html_title("Uniprot keywords values"))
#   after_html <- paste(after_html,html_table("uniprot_vals.txt","Uniprot keyword values"),sep="<br>\n")
#   after_html <- paste(after_html,html_image("uniprot_heatmap.png","Heatmap"),sep="<br>\n")
#   after_html <- paste(after_html,html_image("uniprot_pca.png","PCA"),sep="<br>\n")
#   after_html <- paste(after_html,html_table("uniprot_comparison.txt","Uniprot keyword significance"),sep="<br>\n")
# }
# 
# create.html.report2(fpathigraphs,wt,pretty_home,output_folder,effector=(decompose==F),extra_javascript = extra_javascript, before_html = before_html,after_html = after_html)








